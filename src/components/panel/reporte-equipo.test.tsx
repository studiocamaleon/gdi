import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EquipoPanel, TabPanel } from "@/lib/panel-api";
import { ReporteEquipo } from "./reporte-equipo";

const datos: TabPanel<EquipoPanel> = {
  meta: {
    fuente: "Tramos de trabajo y pasos completados",
    limites: ["Trabajo cronometrado, no asistencia."],
    sinComparativa: true,
    rango: { desde: "2026-09-01", hasta: "2026-09-30" },
    rangoAnterior: { desde: "2026-08-01", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  margenesVisibles: true,
  comisionesVisibles: true,
  muestraMinima: 20,
  kpis: {
    personasActivas: 2,
    minutosProductivos: 7.07,
    pasosCompletados: 30,
    medidoPct: 66.67,
    vendedoresActivos: 2,
  },
  personas: [
    {
      id: "z",
      nombre: "Zoe López",
      minutos: 6.15,
      pasos: 2,
      dias: 2,
      familias: 2,
      autoPausas: 1,
    },
    {
      id: "a",
      nombre: "Ana Pérez",
      minutos: 0.92,
      pasos: 1,
      dias: 1,
      familias: 1,
      autoPausas: 0,
    },
  ],
  disciplina: [
    {
      id: "a",
      nombre: "Ana Pérez",
      pasos: 30,
      medidos: 20,
      declarados: 5,
      estimados: 4,
      invalidos: 1,
      medidoPct: 66.67,
      autoPausas: 2,
    },
  ],
  eficiencia: [
    {
      id: "z",
      nombre: "Zoe López",
      muestras: 20,
      desvioPct: -12.25,
      serie: [
        { semana: "2026-09-07", desvioPct: -15.75, muestras: 8 },
        { semana: "2026-09-14", desvioPct: -10.25, muestras: 12 },
      ],
    },
    { id: "a", nombre: "Ana Pérez", muestras: 1, desvioPct: null, serie: [] },
    {
      id: "b",
      nombre: "Bruno",
      muestras: 22,
      desvioPct: 24.15,
      serie: [{ semana: "2026-09-07", desvioPct: 24.15, muestras: 22 }],
    },
  ],
  polivalencia: [
    { nombre: "Zoe López", familia: "Impresión", minutos: 6.15, pasos: 2 },
    { nombre: "Ana Pérez", familia: "Corte", minutos: 0.92, pasos: 1 },
  ],
  familiasSinRespaldo: [
    { familia: "Impresión", persona: "Zoe López" },
    { familia: "Corte", persona: "Ana Pérez" },
  ],
  vendedores: [
    {
      empleadoId: "s",
      nombre: "Sofía",
      ordenes: 3,
      facturado: 12345.67,
      ticketPromedio: 4115.22,
      margenPct: -12.34,
      margen: -1500,
      itemsSinCosto: 2,
      comisionEstimada: 765.43,
    },
    {
      empleadoId: null,
      nombre: "Sin vendedor",
      ordenes: 1,
      facturado: 0,
      ticketPromedio: 0,
      margenPct: null,
      margen: null,
      itemsSinCosto: 0,
      comisionEstimada: null,
    },
  ],
};
const render = (d = datos) => renderToStaticMarkup(<ReporteEquipo d={d} />);
const table = (html: string, label: string) =>
  html.match(
    new RegExp(`<table[^>]*aria-label="${label}"[\\s\\S]*?</table>`),
  )?.[0] ?? "";

describe("Reporte de Equipo", () => {
  it("conserva precisión de tiempos y porcentajes, y no ordena operarios por rendimiento", () => {
    const html = render();
    expect(html.match(/data-reporte-indicador=/g)).toHaveLength(5);
    expect(html).toContain("7,07 minutos cronometrados");
    expect(html).toContain("0,12 h");
    expect(html).toContain("66,67%");
    const trabajo = table(html, "Trabajo por persona");
    expect(trabajo.indexOf("Ana Pérez")).toBeLessThan(
      trabajo.indexOf("Zoe López"),
    );
    expect(trabajo).toContain("0,92");
    expect(trabajo).toContain(
      'data-reporte-exportar="Zoe López · 1 pausa automática"',
    );
    expect(html).toContain("pueden seguir en curso");
  });
  it("mantiene el umbral de muestra y el signo de los desvíos, incluso cero", () => {
    const html = render({
      ...datos,
      eficiencia: [
        ...datos.eficiencia,
        { id: "c", nombre: "Cero", muestras: 20, desvioPct: 0, serie: [] },
        {
          id: "x",
          nombre: "Muestra pequeña",
          muestras: 19,
          desvioPct: 98.76,
          serie: [{ semana: "2026-09-01", desvioPct: 98.76, muestras: 19 }],
        },
      ],
    });
    expect(html).toContain(
      'data-reporte-exportar="-12,25% · Menos tiempo que el cotizado"',
    );
    expect(html).toContain(
      'data-reporte-exportar="+24,15% · Más tiempo que el cotizado"',
    );
    expect(html).toContain('data-reporte-exportar="0% · Igual al cotizado"');
    expect(html).toContain("Sin muestra suficiente (19/20)");
    expect(html).not.toContain("98,76");
  });
  it("exporta todos los datos semanales y de registro aunque el detalle esté plegado", () => {
    const html = render();
    expect(html).toContain('data-chart="tremor-spark"');
    const semana = table(html, "Desvíos semanales por persona");
    expect(semana).toContain("7 de sept de 2026");
    expect(semana).toContain("-15,75%");
    expect(semana).toContain(">8</td>");
    expect(semana).toContain("Bruno");
    expect(semana).not.toContain("Ana Pérez");
    expect(html).toContain("Una semana registrada");
    const registro = table(html, "Detalle de las fuentes del tiempo");
    for (const value of [30, 20, 5, 4, 1, 2])
      expect(registro).toContain(`>${value}</td>`);
    expect(html).not.toMatch(/<details[^>]* open/);
  });
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    "respeta margen=%s y comisiones=%s en pantalla y exportación",
    (margenesVisibles, comisionesVisibles) => {
      const html = render({ ...datos, margenesVisibles, comisionesVisibles });
      expect(html.includes("-12,34%")).toBe(margenesVisibles);
      expect(html.includes('data-negative="true"')).toBe(margenesVisibles);
      expect(html.includes("ítems sin costo")).toBe(margenesVisibles);
      expect(html.includes("765,43")).toBe(comisionesVisibles);
      expect(html.includes("Comisión estimada")).toBe(comisionesVisibles);
      expect(html).toContain("12.345,67");
      expect(html).toContain("4.115,22");
    },
  );
  it("conserva cero de comisión y distingue la falta de regla", () => {
    const html = render({
      ...datos,
      vendedores: [
        { ...datos.vendedores[0], comisionEstimada: 0 },
        datos.vendedores[1],
      ],
    });
    const ventas = table(html, "Ventas por vendedor");
    expect(ventas).not.toContain("765,43");
    expect(ventas).toMatch(/<td>[^<]*0,00<\/td>/);
    expect(ventas).toContain("Sin regla");
  });
  it("muestra la matriz completa, nombres completos y datos textuales sin depender del color", () => {
    const html = render({
      ...datos,
      polivalencia: Array.from({ length: 10 }, (_, i) => ({
        nombre: `Persona Completa ${i}`,
        familia: `Familia ${i}`,
        minutos: 0.25 + i,
        pasos: i + 1,
      })),
    });
    const matriz = table(html, "Polivalencia observada");
    for (let i = 0; i < 10; i++) {
      expect(matriz).toContain(`Persona Completa ${i}`);
      expect(matriz).toContain(`Familia ${i}`);
    }
    expect(matriz).toContain('data-reporte-exportar="0,25 min · 1 paso"');
    expect(matriz).toContain('data-reporte-exportar="Sin trabajo registrado"');
    expect(html).toContain("Una celda vacía no implica");
  });
  it("no confunde ausencia de datos con cobertura compartida ni medición perfecta", () => {
    const html = render({
      ...datos,
      kpis: {
        personasActivas: 0,
        minutosProductivos: 0,
        pasosCompletados: 0,
        medidoPct: null,
        vendedoresActivos: 0,
      },
      personas: [],
      disciplina: [],
      eficiencia: [],
      polivalencia: [],
      familiasSinRespaldo: [],
      vendedores: [],
    });
    for (const text of [
      "Sin trabajo registrado",
      "Sin pasos completados",
      "Sin tiempos comparables",
      "Sin cobertura observada",
      "Sin datos de cobertura",
      "Sin ventas en el período",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("Cobertura compartida");
    expect(html).not.toContain("100%");
    expect(html).not.toContain("NaN");
    expect(html).toContain("Trabajo cronometrado, no asistencia.");
  });
});
