import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProduccionPanel, TabPanel } from "@/lib/panel-api";
import { ReporteProduccion } from "./reporte-produccion";

const datos: TabPanel<ProduccionPanel> = {
  meta: {
    fuente: "Pasos de producción",
    limites: ["La eficiencia usa sólo tiempos medidos."],
    sinComparativa: true,
    rango: { desde: "2026-09-01", hasta: "2026-09-30" },
    rangoAnterior: { desde: "2026-08-01", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  kpis: {
    otdPct: 50,
    atrasoPromedioDias: 2,
    leadTimeDias: 1.25,
    eficienciaPct: 150,
    bloqueados: 3,
    utilizacionPct: 120.25,
    trabajosEnCola: 4,
    diasDeCarga: 0.25,
  },
  otd: {
    total: 2,
    aTiempo: 1,
    tarde: 1,
    sinFecha: 1,
    otdPct: 50,
    atrasoPromedioDias: 2,
    leadTimeDias: 1.25,
    atrasadas: [
      {
        numero: "OT-0060",
        cliente: "Cliente de prueba",
        fechaEntrega: "2026-09-01",
        diasAtraso: 2,
      },
    ],
  },
  eficiencia: {
    eficienciaPct: 150,
    atipicosExcluidos: 2,
    porFamilia: [
      {
        familia: "Impresión",
        estimadoMin: 0.2,
        realMin: 0.3,
        razon: 1.5,
        muestras: 2,
      },
      {
        familia: "Corte",
        estimadoMin: 10,
        realMin: 5,
        razon: 0.5,
        muestras: 4,
      },
      {
        familia: "Sin estimado",
        estimadoMin: 0,
        realMin: 1,
        razon: null,
        muestras: 1,
      },
    ],
  },
  utilizacion: [
    {
      centro: "Taller",
      horasReales: 120.25,
      capacidadPractica: 100,
      pct: 120.25,
    },
    { centro: "Diseño", horasReales: 0.01, capacidadPractica: 0, pct: null },
    { centro: "Impresión", horasReales: 0, capacidadPractica: 100, pct: 0 },
  ],
  throughput: [{ fecha: "2026-09-01", cantidad: 1 }],
  bloqueos: [{ motivo: "Falta archivo", veces: 3 }],
  registroTiempos: {
    totalPasos: 4,
    confiablePct: 25,
    fuentes: [
      { fuente: "medido_lote", pasos: 1, pct: 25 },
      { fuente: "declarado", pasos: 2, pct: 50 },
      { fuente: "fuente futura", pasos: 1, pct: 25 },
    ],
    pausas: [{ motivo: "Fin de jornada", veces: 2 }],
    operadores: [],
  },
  ahorros: {
    periodo: { tandas: 0, jobs: 0, ahorroMl: 0, ahorroPesos: 0 },
    historico: { tandas: 2, jobs: 5, ahorroMl: 1.23, ahorroPesos: 1450.67 },
    porMaterial: [
      {
        material: "Vinilo",
        tecnologia: null,
        tandas: 2,
        ahorroMl: 1.23,
        ahorroPesos: 1450.67,
      },
    ],
  },
};
const render = (d = datos) => renderToStaticMarkup(<ReporteProduccion d={d} />);

describe("Reporte de Producción", () => {
  it("mantiene los conteos actuales separados del período y no los muestra como deltas", () => {
    const html = render();
    expect(html).toContain("0,25 días de carga estimada · hoy");
    expect(html).toContain(
      "Pasos bloqueados por motivo · independiente del período",
    );
    expect(html).toContain("Falta archivo");
    expect(html).not.toContain("+3%");
    expect(html.match(/data-reporte-indicador=/g)).toHaveLength(5);
    expect(html).toContain("Desde emisión hasta fin de producción");
  });
  it("conserva minutos fraccionarios, sentido del desvío y tamaño de muestra", () => {
    const html = render();
    expect(html).toContain("0,2 min");
    expect(html).toContain("0,3 min");
    expect(html).toContain('data-reporte-exportar="+50% · Más lento"');
    expect(html).toContain('data-reporte-exportar="-50% · Más rápido"');
    expect(html).toContain("2 pasos medidos · muestra pequeña");
    expect(html).toContain("2 tiempo(s) atípico(s) excluido(s).");
    expect(html).toContain("Mediana por familia");
  });
  it("no recorta el porcentaje de utilización ni confunde cero con capacidad ausente", () => {
    const html = render();
    expect(html).toContain("120,25%");
    expect(html).toContain("120,25 h");
    expect(html).toContain("0,01 h");
    expect(html).toContain("Sin capacidad cargada");
    expect(html).toMatch(/<td[^>]*>0%<\/td>/);
    expect(html).not.toContain("width:120.25%");
  });
  it("con un único día mantiene el gráfico y los datos exportables sin inventar fechas", () => {
    const html = render();
    expect(html).toContain('data-chart="tremor-bar"');
    expect(html).toContain('aria-label="Datos de producción diaria"');
    expect(html).toContain("1 de sept de 2026");
    expect(html).not.toContain("2 de sept de 2026");
    expect(html).toContain(
      'data-reporte-exportar="OT-0060 · Cliente de prueba"',
    );
    expect(html).toContain('data-reporte-exportar="1 de sept de 2026"');
    expect(html).toContain("1 orden(es) sin fecha de entrega");
  });
  it("mantiene el ahorro histórico aunque el período no tenga consolidaciones", () => {
    const html = render();
    expect(html).toContain("1.450,67");
    expect(html).toContain("1,23 m lineales");
    expect(html).toContain("Acumulado histórico");
    expect(html).toContain('aria-label="Resumen de ahorros por alcance"');
    expect(html).toContain(
      'data-reporte-exportar="Vinilo · Sin tecnología asociada"',
    );
    expect(html).toContain("0,00");
    expect(html).not.toContain("Sin ahorros registrados");
  });
  it("conserva las fuentes nuevas y advierte cuando hay pocas mediciones", () => {
    const html = render();
    expect(html).toContain("Medido en tanda");
    expect(html).toContain("fuente futura");
    expect(html).toContain(
      "Menos de la mitad de los pasos tiene tiempo medido.",
    );
    expect(html).toContain("Fin de jornada");
    expect(html).toContain("La eficiencia usa sólo tiempos medidos.");
  });
  it("distingue ausencia de actividad de cumplimiento perfecto y conserva la cola actual", () => {
    const html = render({
      ...datos,
      kpis: {
        ...datos.kpis,
        otdPct: null,
        leadTimeDias: null,
        eficienciaPct: null,
        diasDeCarga: null,
      },
      otd: { ...datos.otd, total: 0, aTiempo: 0, tarde: 0, atrasadas: [] },
      throughput: [],
      utilizacion: [],
      eficiencia: { ...datos.eficiencia, porFamilia: [] },
      registroTiempos: {
        totalPasos: 0,
        confiablePct: null,
        fuentes: [],
        pausas: [],
        operadores: [],
      },
      ahorros: {
        periodo: datos.ahorros.periodo,
        historico: datos.ahorros.periodo,
        porMaterial: [],
      },
    });
    expect(html).toContain("Sin órdenes para evaluar");
    expect(html).not.toContain("Todas las órdenes, a tiempo");
    expect(html).not.toContain('data-chart="tremor-bar"');
    expect(html).toContain("Sin tiempos comparables");
    expect(html).toContain("Sin registros de tiempo");
    expect(html).toContain("Sin utilización registrada");
    expect(html).toContain("Hoy · sin capacidad cargada");
    expect(html).toContain("Falta archivo");
    expect(html).toContain("Sin ahorros registrados");
  });
});
