import { describe, expect, it } from "vitest";
import { describirEta, fechaRecomendadaEta } from "./eta-fechas";
import {
  etiquetaEta,
  sumarDiasHabiles,
  type SimulacionItem,
} from "./flujo-produccion";
import { offsetDate } from "./propuestas";
import { diasHastaEntrega, prioridadDerivada } from "./tablero-produccion";
import { esFechaCalendario, diasEntreClaves } from "./zona";
import { prioridadDerivada as prioridadBackend } from "../../apps/api/src/eta/motor/tablero-tipos";
import { sumarDiasHabiles as margenBackend } from "../../apps/api/src/eta/motor/flujo-produccion";
const zona = "America/Argentina/Buenos_Aires";
const ahora = new Date("2026-09-09T18:30:00Z");
const eta = (fin = "2026-09-09T19:39:00Z"): SimulacionItem => ({
  finEstimado: new Date(fin),
  sinEstimar: false,
  parcial: false,
  asumeDesbloqueo: false,
});

describe("fechas de producción y entrega", () => {
  it("explica el caso 09/09: fin hoy y entrega 10/09 por un día hábil de margen", () => {
    const opts = { zona, ahora, margenDias: 1 };
    expect(describirEta(eta(), "2026-09-10", opts)).toMatchObject({
      etiqueta: "≈ hoy · 09/09/2026 16:39",
      sugeridaEtiqueta: "10/09/2026 16:39",
      margenEtiqueta: "1 día hábil de margen",
      fechaProduccion: "2026-09-09",
      fechaSugerida: "2026-09-10",
      margenDias: 1,
      nivel: "ok",
    });
    expect(fechaRecomendadaEta(eta(), opts)).toBe("2026-09-10");
    expect(describirEta(eta(), "2026-09-09", opts)?.nivel).toBe("sin-margen");
    expect(describirEta(eta(), "2026-09-08", opts)?.nivel).toBe("tarde");
  });
  it("la noche del 09/09 no se vuelve 10/09 aunque UTC ya cambió de día", () => {
    const noche = new Date("2026-09-10T01:30:00Z");
    expect(offsetDate(0, zona, noche)).toBe("2026-09-09");
    expect(offsetDate(7, zona, noche)).toBe("2026-09-16");
    expect(fechaRecomendadaEta(eta(noche.toISOString()), { zona })).toBe(
      "2026-09-09",
    );
    expect(etiquetaEta(noche, noche, zona)).toBe("hoy 22:30");
    expect(diasHastaEntrega("2026-09-09", noche, zona)).toBe(0);
    expect(
      describirEta(eta(noche.toISOString()), "2026-09-09", {
        zona,
        ahora: noche,
      })?.nivel,
    ).toBe("ok");
  });
  it("ayer y fechas pasadas no se rotulan como hoy", () => {
    expect(etiquetaEta(new Date("2026-09-08T15:00:00Z"), ahora, zona)).toBe(
      "ayer 12:00",
    );
    expect(etiquetaEta(new Date("2026-08-30T15:00:00Z"), ahora, zona)).toBe(
      "30/08/2026",
    );
  });
  it("no recomienda la fecha de los pasos conocidos si falta estimar otro", () => {
    const incompleta = { ...eta(), sinEstimar: true };
    expect(fechaRecomendadaEta(incompleta, { zona, margenDias: 1 })).toBeNull();
    expect(describirEta(incompleta, null)?.etiqueta).toBe(
      "Sin estimación completa",
    );
    expect(describirEta(incompleta, null)?.sugeridaEtiqueta).toBeNull();
    expect(describirEta(incompleta, null)).toMatchObject({
      fechaProduccion: null,
      fechaSugerida: null,
    });
  });
  it("las fechas sin hora respetan la zona, feriados y el margen cero", () => {
    const fin = eta("2027-01-01T01:30:00Z"); // 31/12 22:30 en el taller
    const opts = { zona, noLaborables: new Set(["2027-01-01"]) };
    expect(describirEta(fin, null, { ...opts, margenDias: 1 })).toMatchObject({
      fechaProduccion: "2026-12-31",
      fechaSugerida: "2027-01-04",
    });
    expect(describirEta(fin, null, { ...opts, margenDias: 0 })).toMatchObject({
      fechaProduccion: "2026-12-31",
      fechaSugerida: "2026-12-31",
      margenDias: 0,
    });
  });
  it.each([
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-09-09T23:00:00-03:00",
  ])("rechaza una fecha calendario inválida: %s", (f) => {
    expect(esFechaCalendario(f)).toBe(false);
  });
  it("mantiene calendario, año y hora del taller al cruzar feriados y fin de año", () => {
    const fin = new Date("2026-12-31T19:39:00Z");
    const feriados = new Set(["2027-01-01"]);
    expect(sumarDiasHabiles(fin, 1, feriados, zona).toISOString()).toBe(
      "2027-01-04T19:39:00.000Z",
    );
    expect(margenBackend(fin, 1, feriados, zona)).toEqual(
      sumarDiasHabiles(fin, 1, feriados, zona),
    );
  });
  it("cruza el cambio de hora de Chile sin perder ni sumar un día", () => {
    const fin = new Date("2026-09-04T20:39:00Z"); // viernes 16:39 CL antes del DST
    const esperado = new Date("2026-09-07T19:39:00Z"); // lunes 16:39 CL después del DST
    expect(sumarDiasHabiles(fin, 1, new Set(), "America/Santiago")).toEqual(
      esperado,
    );
    expect(margenBackend(fin, 1, new Set(), "America/Santiago")).toEqual(
      esperado,
    );
    expect(diasEntreClaves("2026-09-04", "2026-09-07")).toBe(3);
  });
  it("las prioridades usan la fecha de simulación y la zona, también en backend", () => {
    const simulacion = new Date("2030-01-01T02:30:00Z"); // 31/12 en Argentina
    for (const prioridad of [prioridadDerivada, prioridadBackend]) {
      expect(prioridad("2030-01-01", simulacion, zona)).toBe("high");
      expect(prioridad("2029-12-31", simulacion, zona)).toBe("urgent");
      expect(prioridad("2030-01-01", simulacion, "UTC")).toBe("urgent");
    }
  });
});
