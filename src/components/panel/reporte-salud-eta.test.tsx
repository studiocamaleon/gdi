import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SaludEtaPanel, TabPanel } from "@/lib/panel-api";
import { ReporteSaludEta } from "./reporte-salud-eta";

const datos: TabPanel<SaludEtaPanel> = {
  meta: {
    fuente: "Promesas ETA y tiempos medidos",
    limites: ["Precisión sobre promesas registradas en el rango."],
    sinComparativa: true,
    rango: { desde: "2026-09-01", hasta: "2026-09-30" },
    rangoAnterior: { desde: "2026-08-01", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  precision: {
    cerradas: 3,
    muestras: 2,
    sinEstimar: 1,
    coberturaPct: 66.7,
    maeMin: 465,
    medianaAbsMin: 165,
    p90AbsMin: 1200,
    sesgoMin: -300,
    dentro4hPct: 50,
    dentro1dPct: 75,
    tardePct: 50,
  },
  salud: {
    cobertura: {
      promesas: 6,
      conEtaPct: 83.3,
      sinEstimarPct: 16.7,
      parcialPct: 50,
    },
    sesgoFamilias: [
      {
        familiaCodigo: "corte_laser",
        familiaNombre: "Corte láser",
        muestras: 5,
        medianaEstimadoMin: 10,
        medianaRealMin: 12,
        sesgoMin: 2,
        sesgoPct: 20,
        duracionSugeridaMin: 12,
      },
      {
        familiaCodigo: "trabajo_manual",
        familiaNombre: null,
        muestras: 3,
        medianaEstimadoMin: 100,
        medianaRealMin: 70,
        sesgoMin: -30,
        sesgoPct: -30,
        duracionSugeridaMin: null,
      },
      {
        familiaCodigo: "paso_corto",
        muestras: 5,
        medianaEstimadoMin: 0.2,
        medianaRealMin: 0.4,
        sesgoMin: 0,
        sesgoPct: 0,
        duracionSugeridaMin: null,
      },
    ],
  },
};
const render = (d = datos) => renderToStaticMarkup(<ReporteSaludEta d={d} />);

describe("Reporte Salud del ETA", () => {
  it("mantiene el signo del sesgo en tiempo sin convertirlo en una variación porcentual", () => {
    const html = render();
    expect(html).toContain("−5 h");
    expect(html).toContain("Termina antes, en promedio");
    expect(html).toContain("<td>-300</td>");
    expect(html).not.toContain("300%");
    expect(html).toContain("3 promesas cerradas en la muestra");
    expect(html).not.toContain("OT finalizadas");
  });
  it("diferencia sesgo cero, positivo y ausencia de mediciones", () => {
    const cero = render({
      ...datos,
      precision: { ...datos.precision, sesgoMin: 0, maeMin: 0 },
    });
    expect(cero).toContain("Sin adelanto ni atraso promedio");
    expect(cero).toContain("0 min");
    expect(cero).not.toContain("Termina antes, en promedio");
    const tarde = render({
      ...datos,
      precision: { ...datos.precision, sesgoMin: 45 },
    });
    expect(tarde).toContain("+45 min");
    expect(tarde).toContain("Termina más tarde, en promedio");
  });
  it("expone errores exactos en minutos para exportación aunque el detalle esté cerrado", () => {
    const html = render();
    expect(html).toContain('aria-label="Errores del ETA en minutos"');
    expect(html).toContain("<td>465</td>");
    expect(html).toContain("<td>165</td>");
    expect(html).toContain("<td>1.200</td>");
    expect(html).toContain("1 de sept de 2026");
    expect(html).toContain("Precisión sobre promesas registradas en el rango.");
  });
  it("separa promesas cerradas de todas las promesas y no apila porcentajes superpuestos", () => {
    const html = render();
    expect(html).toContain('aria-label="Cobertura de promesas cerradas"');
    expect(html).toContain('aria-label="Cobertura de todas las promesas"');
    expect(html).toContain("66,7%");
    expect(html).toContain("83,3%");
    expect(html).toContain("abiertas y cerradas");
    expect(html).toContain("los tres porcentajes no se suman");
    expect(html).toContain("±4 horas está incluida en ±1 día");
  });
  it("conserva medianas fraccionarias, signos, sugerencias originales y nombres de familia", () => {
    const html = render();
    expect(html).toContain("0,2 min");
    expect(html).toContain("0,4 min");
    expect(html).toContain(
      'data-reporte-exportar="Corte láser · 5 pasos medidos"',
    );
    expect(html).toContain(
      'data-reporte-exportar="+20% · +2 min · Subestimado"',
    );
    expect(html).toContain(
      'data-reporte-exportar="-30% · -30 min · Sobreestimado"',
    );
    expect(html).toContain("Trabajo manual");
    expect(html).toContain("3 pasos medidos · muestra pequeña");
    expect(html).toContain("Sin sugerencia");
    expect(html).toContain("12 min");
    expect(html).toContain("20% o más");
    expect(html).toContain("Las sugerencias no se aplican automáticamente");
  });
  it("distingue falta de promesas de cobertura completa", () => {
    const html = render({
      ...datos,
      precision: {
        cerradas: 0,
        muestras: 0,
        sinEstimar: 0,
        coberturaPct: 0,
        maeMin: null,
        medianaAbsMin: null,
        p90AbsMin: null,
        sesgoMin: null,
        dentro4hPct: null,
        dentro1dPct: null,
        tardePct: null,
      },
      salud: {
        cobertura: {
          promesas: 0,
          conEtaPct: 0,
          sinEstimarPct: 0,
          parcialPct: 0,
        },
        sesgoFamilias: [],
      },
    });
    expect(html).toContain("Sin promesas cerradas medibles");
    expect(html).toContain("Sin promesas en el período");
    expect(html).toContain("Todavía no hay familias para calibrar");
    expect(html).not.toContain(
      "Todas las promesas del período tienen un ETA estimable",
    );
    expect(html).not.toContain("Termina antes, en promedio");
  });
  it("muestra cobertura cero cuando hay promesas cerradas sin estimar, sin ocultar la cantidad", () => {
    const html = render({
      ...datos,
      precision: {
        ...datos.precision,
        cerradas: 3,
        muestras: 0,
        sinEstimar: 3,
        coberturaPct: 0,
        maeMin: null,
        medianaAbsMin: null,
        p90AbsMin: null,
        sesgoMin: null,
        dentro4hPct: null,
        dentro1dPct: null,
        tardePct: null,
      },
    });
    expect(html).toContain("3 promesas cerradas en la muestra");
    expect(html).toContain("Sin promesas cerradas medibles");
    expect(html).toContain("<td>0%</td>");
    expect(html).toContain("Con ETA estimable");
  });
});
