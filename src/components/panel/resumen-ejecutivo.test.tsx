import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { PROPUESTA_PLANES } from "../../../apps/api/src/plataforma/planes/catalogo-planes";
import type { ResumenData } from "@/lib/panel-api";
import { ResumenEjecutivo } from "./resumen-ejecutivo";

vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams("desde=2026-09-01&hasta=2026-09-16"),
}));
const datos: ResumenData = {
  meta: {
    fuente: "Órdenes emitidas",
    limites: ["Costos estimados del trabajo."],
    sinComparativa: true,
    rango: { desde: "2026-09-01", hasta: "2026-09-16" },
    rangoAnterior: { desde: "2026-08-16", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  rentabilidad: {
    ventas: 80.5,
    ventasDeltaPct: null,
    margenBruto: -19.75,
    margenBrutoPct: -24.5,
    contribucion: 50,
    contribucionPct: 62.1,
    puntoEquilibrio: null,
    avancePct: null,
    costoTotal: 100.25,
  },
  produccion: {
    otdPct: null,
    utilizacionPct: null,
    trabajosEnCola: 0,
    diasDeCarga: null,
  },
  serie: [{ fecha: "2026-09-01", monto: 80.5, costo: 100.25 }],
  topClientes: [],
  topProductos: [],
  alertas: [],
};
const render = (
  d = datos,
  permisos = ["reportes.ver", "reportes.ver_resumen"],
  funciones?: Record<string, boolean>,
) =>
  renderToStaticMarkup(
    <PermisosProvider permisos={permisos}>
      <CapacidadesProvider capacidades={{ funciones }}>
        <ResumenEjecutivo d={d} />
      </CapacidadesProvider>
    </PermisosProvider>,
  );

describe("Resumen ejecutivo", () => {
  it.each([0, 1, 2])("los enlaces a análisis detallado respetan el plan %s", indice => {
    const html = render(datos, ["reportes.ver", "reportes.ver_resumen", "finanzas.ver_margenes"], PROPUESTA_PLANES[indice].contenido.funciones);
    for (const texto of ["Analizar clientes", "Analizar productos", "Analizar finanzas"])
      expect(html.includes(texto)).toBe(indice !== 0);
    expect(html).toContain("Clientes principales");
    expect(html).toContain("Productos con más ventas");
  });
  it("expone la pérdida con precisión en los datos y mantiene los puntos de exportación", () => {
    const html = render();
    expect(html).toContain("-19,75");
    expect(html).toContain('aria-label="Datos de ventas, costo y margen"');
    expect(html.match(/data-reporte-indicador=/g)).toHaveLength(5);
    expect(html).toContain("Costos estimados del trabajo.");
    expect(html).toContain("Sin período anterior para comparar.");
  });
  it("distingue ausencia de datos de cero ventas y cero cumplimiento", () => {
    const html = render({ ...datos, serie: [] });
    expect(html).toContain("Todavía no hay ventas en este período");
    expect(html).toContain("Sin entregas evaluables");
    expect(html).toContain("Equilibrio aún no calculable");
    expect(html).not.toContain('data-chart="tremor-bar"');
  });
  it("conserva el rango al navegar y no ofrece Finanzas sin permiso", () => {
    const html = render();
    expect(html).toContain(
      "/reportes/clientes?desde=2026-09-01&amp;hasta=2026-09-16",
    );
    expect(html).not.toContain("Analizar finanzas");
    expect(
      render(datos, [
        "reportes.ver",
        "reportes.ver_resumen",
        "finanzas.ver_margenes",
      ]),
    ).toContain("Analizar finanzas");
  });
  it("muestra avances superiores al 100% sin recortar el valor del indicador", () => {
    const html = render({
      ...datos,
      rentabilidad: {
        ...datos.rentabilidad,
        puntoEquilibrio: 40,
        avancePct: 201.25,
        costosFijos: 30,
      },
    });
    expect(html).toContain("201,3%");
    expect(html).toContain("Estructura cubierta");
    expect(html).toContain("Por encima del equilibrio");
  });
});
