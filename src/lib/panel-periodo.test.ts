import { describe, expect, it } from "vitest";

import {
  esFechaCalendario,
  leerRangoPersonalizado,
  rangoDe,
  rangoDeParametros,
} from "./panel-periodo";

describe("períodos de Reportes", () => {
  it("acepta un rango personalizado completo e inclusivo", () => {
    expect(rangoDeParametros({ desde: "2026-07-03", hasta: "2026-08-17" })).toEqual({
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
