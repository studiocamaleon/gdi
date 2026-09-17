import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ComercialPanel, MetaPanel } from "@/lib/panel-api";
import { ReporteComercial } from "./reporte-comercial";

const datos: ComercialPanel & { meta: MetaPanel } = {
  meta: {
    fuente: "Órdenes emitidas",
    limites: ["Historial de clientes disponible."],
    sinComparativa: true,
    rango: { desde: "2026-09-01", hasta: "2026-09-16" },
    rangoAnterior: { desde: "2026-08-16", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  kpis: {
    ventas: 80.5,
    ventasDeltaPct: null,
    ventasDeltaAnualPct: null,
    ordenes: 2,
    ordenesDeltaPct: null,
    ticketPromedio: 40.25,
    itemsPorOrden: 1.5,
    nuevosClientes: 3,
    clientesDormidos: 7,
  },
  serie: [{ fecha: "2026-09-01", monto: -19.75 }],
  serieTicket: [
    {
      fecha: "2026-09-01",
      ordenes: 2,
      ticketPromedio: 40.25,
      ticketMediana: 20.15,
    },
  ],
  granularidad: "dia",
  rankingClientes: [
    { id: null, nombre: "Cliente de prueba", ordenes: 2, facturado: 80.5 },
  ],
  rankingVendedores: [],
  mixCategoria: [{ nombre: "Gran formato", monto: 80.5, pct: 100 }],
  mixTecnologia: [],
  estacionalidad: [{ categoria: "Gran formato", mes: "2026-09", monto: 80.5 }],
  dormidos: [
    {
      clienteId: null,
      cliente: "Cliente anterior",
      ultimaCompra: "2026-01-15",
      diasSinComprar: 244,
      historico: 6,
    },
  ],
};
const render = (d = datos) => renderToStaticMarkup(<ReporteComercial d={d} />);

describe("Reporte Comercial", () => {
  it("diferencia los contadores de clientes de una variación porcentual", () => {
    const html = render();
    expect(html).toContain("Primera compra en el período");
    expect(html).toContain("Recurrentes sin actividad reciente");
    expect(html).not.toContain("+3%");
    expect(html).not.toContain("+7%");
    expect(html).toContain("1,5 ítems por orden");
    expect(html).toContain("Órdenes históricas");
    expect(html).toContain("15 de ene de 2026");
    expect(html.match(/data-reporte-indicador=/g)).toHaveLength(5);
  });
  it("conserva valores negativos, mediana y decimales en tablas exportables aun con un único punto", () => {
    const html = render();
    expect(html).toContain("-19,75");
    expect(html).toContain("20,15");
    expect(html).toContain("Mediana · discontinua");
    expect(html.match(/data-chart="tremor-area"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Datos de ventas"');
    expect(html).toContain('aria-label="Datos del ticket"');
    expect(html).toContain('data-reporte-exportar="Cliente de prueba"');
    expect(html).toContain("sept 2026");
    expect(html).toContain("Historial de clientes disponible.");
  });
  it("no dibuja historia inventada cuando no hay ventas y conserva la actividad histórica", () => {
    const html = render({
      ...datos,
      serie: [],
      serieTicket: [],
      mixCategoria: [],
      estacionalidad: [],
      dormidos: [],
    });
    expect(html).not.toContain('data-chart="tremor-area"');
    expect(html).toContain("Sin ventas para distribuir");
    expect(html).toContain("Todavía no hay historia de ventas");
    expect(html).toContain("Sin clientes dormidos identificados");
    expect(html).toContain("Cliente de prueba");
  });
  it("mantiene la comparación anual y representa valores cero sin volverlos ausencias", () => {
    const html = render({
      ...datos,
      kpis: { ...datos.kpis, ventasDeltaPct: 0, ventasDeltaAnualPct: -12.5 },
      serie: [{ fecha: "2026-09-01", monto: 0 }],
    });
    expect(html).toContain("-12,5% vs. año anterior");
    expect(html).toContain("vs. período anterior");
    expect(html).toContain('aria-label="Datos de ventas"');
  });
});
