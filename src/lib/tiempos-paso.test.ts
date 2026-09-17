import { describe, expect, it } from "vitest";
import {
  cumplimientoPaso,
  finActualPaso,
  finPrevistoPaso,
} from "./tiempos-paso";
import type { TableroPasoData } from "./tablero-produccion";

const previsto = new Date("2026-09-14T15:00:00Z");
const paso = (values: Partial<TableroPasoData>) => values as TableroPasoData;

describe("Cumplimiento del paso", () => {
  it.each([
    ["2026-09-14T15:00:59Z", "En horario"],
    ["2026-09-14T14:15:00Z", "Adelantado 45 min"],
    ["2026-09-14T17:30:00Z", "Demorado 2 h 30 min"],
    ["2026-09-16T16:05:00Z", "Demorado 2 d 1 h 5 min"],
    ["2026-09-13T15:00:00Z", "Adelantado 1 d"],
  ])("compara fechas a precisión de minuto: %s", (actual, texto) => {
    expect(cumplimientoPaso(previsto, new Date(actual)).texto).toBe(texto);
  });
  it("no muestra en horario cuando falta referencia o estimación", () => {
    expect(cumplimientoPaso(null, previsto).tipo).toBe("sin-datos");
    expect(cumplimientoPaso(previsto, null).tipo).toBe("sin-datos");
  });
  it("prefiere la referencia persistida y admite planes aceptados anteriores", () => {
    expect(
      finPrevistoPaso(
        paso({
          planReferencia: {
            inicio: "2026-09-14T14:00:00Z",
            fin: previsto.toISOString(),
            origen: "automatico",
            fijadoEl: "2026-09-14T13:00:00Z",
          },
          planificadoHasta: "2026-09-15T15:00:00Z",
        }),
      ),
    ).toEqual(previsto);
    expect(
      finPrevistoPaso(paso({ planificadoHasta: previsto.toISOString() })),
    ).toEqual(previsto);
    expect(finPrevistoPaso(paso({ planificadoHasta: "invalid" }))).toBeNull();
    expect(finPrevistoPaso()).toBeNull();
  });
  it("usa el fin de la operación y no el final de sus franjas de atención", () => {
    const p = paso({
      estado: "pendiente",
      asignacionPersonal: {
        origen: "automatica",
        personas: [],
        esMia: false,
        conflicto: null,
        franjas: [
          {
            inicio: "2026-09-14T14:00:00Z",
            fin: "2026-09-14T15:05:00Z",
            empleadoIds: ["a"],
          },
        ],
      },
    });
    expect(finActualPaso(p, previsto)).toEqual(previsto);
    expect(finActualPaso(p)).toBeNull();
  });
  it("al completar prevalece el registro real; sin registro histórico no fabrica una fecha", () => {
    const fin = "2026-09-14T16:00:00Z";
    expect(
      finActualPaso(paso({ estado: "hecho", completadoEl: fin }), previsto),
    ).toEqual(new Date(fin));
    expect(
      finActualPaso(paso({ estado: "hecho", completadoEl: null }), previsto),
    ).toBeNull();
  });
});
