import { afterEach, describe, expect, it, vi } from "vitest";

import {
  esFechaCalendario,
  leerPeriodo,
  leerRangoPersonalizado,
  rangoDe,
  rangoDeParametros,
} from "./panel-periodo";

describe("períodos de Reportes", () => {
  afterEach(() => vi.useRealTimers());

  it("reconoce hoy y semana sin cambiar el período predeterminado", () => {
    expect(leerPeriodo("hoy")).toBe("hoy");
    expect(leerPeriodo(["semana"])).toBe("semana");
    expect(leerPeriodo(undefined)).toBe("mes");
    expect(leerPeriodo("desconocido")).toBe("mes");
    expect(rangoDe("mes")).toEqual({});
  });

  it("hoy usa la fecha de la empresa aunque en UTC ya haya cambiado el día", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-19T01:00:00Z"));
    expect(rangoDeParametros({ periodo: "hoy" }, "America/Argentina/Buenos_Aires")).toEqual({
      desde: "2026-10-18", hasta: "2026-10-18",
    });
    expect(rangoDe("hoy", "Asia/Tokyo")).toEqual({
      desde: "2026-10-19", hasta: "2026-10-19",
    });
  });

  it.each([
    ["2026-10-19", "2026-10-19", "2026-10-25"], // lunes
    ["2026-10-21", "2026-10-19", "2026-10-25"],
    ["2026-10-25", "2026-10-19", "2026-10-25"], // domingo
    ["2027-01-01", "2026-12-28", "2027-01-03"],
    ["2024-02-29", "2024-02-26", "2024-03-03"],
  ])("la semana de %s incluye lunes a domingo", (hoy, desde, hasta) => {
    vi.useFakeTimers().setSystemTime(new Date(`${hoy}T15:00:00Z`));
    expect(rangoDeParametros({ periodo: "semana" })).toEqual({ desde, hasta });
  });

  it("no adelanta la semana cuando el servidor ya está en lunes y la empresa sigue en domingo", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-19T01:00:00Z"));
    expect(rangoDe("semana", "America/Argentina/Buenos_Aires")).toEqual({
      desde: "2026-10-12", hasta: "2026-10-18",
    });
  });

  it("conserva siete días calendario en una semana con cambio de horario", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-03-08T15:00:00Z"));
    expect(rangoDe("semana", "America/New_York")).toEqual({
      desde: "2026-03-02", hasta: "2026-03-08",
    });
  });

  it("acepta un rango personalizado completo e inclusivo", () => {
    expect(rangoDeParametros({ periodo: "semana", desde: "2026-07-03", hasta: "2026-08-17" })).toEqual({
      desde: "2026-07-03",
      hasta: "2026-08-17",
    });
  });

  it("rechaza fechas inexistentes o invertidas", () => {
    expect(esFechaCalendario("2026-02-29")).toBe(false);
    expect(leerRangoPersonalizado("2026-08-18", "2026-08-17")).toBeNull();
    expect(leerRangoPersonalizado("2026-08-01", undefined)).toBeNull();
  });

  it("ante parámetros inválidos vuelve al preset sin enviar basura al API", () => {
    expect(
      rangoDeParametros({ periodo: "mesPasado", desde: "no-es-fecha", hasta: "2026-08-17" }),
    ).toEqual(rangoDe("mesPasado"));
  });
});
