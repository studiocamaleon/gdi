import { describe, expect, it } from "vitest";

import { calcularConsumoTonerGm2 } from "@/lib/calculadora-toner";

describe("calculadora de tóner", () => {
  it("mantiene el rendimiento y calcula g/m² a cobertura ISO", () => {
    const resultado = calcularConsumoTonerGm2({
      gramosNetos: 600,
      rendimientoPaginasA4: 33_000,
      coberturaIsoPorcentaje: 5,
      coberturaObjetivoPorcentaje: 5,
    });

    expect(resultado?.rendimientoEsperadoPaginasA4).toBe(33_000);
    expect(resultado?.consumoGm2Redondeado).toBe(0.29);
    expect(resultado?.formulaVersion).toBe("toner-lineal-a4-v1");
  });

  it("ajusta linealmente rendimiento y consumo para full color", () => {
    const resultado = calcularConsumoTonerGm2({
      gramosNetos: 600,
      rendimientoPaginasA4: 33_000,
      coberturaIsoPorcentaje: 5,
      coberturaObjetivoPorcentaje: 40,
    });

    expect(resultado?.rendimientoEsperadoPaginasA4).toBe(4_125);
    expect(resultado?.consumoGm2Redondeado).toBe(2.33);
  });

  it("rechaza datos incompletos o no positivos", () => {
    expect(
      calcularConsumoTonerGm2({
        gramosNetos: 0,
        rendimientoPaginasA4: 33_000,
        coberturaIsoPorcentaje: 5,
        coberturaObjetivoPorcentaje: 40,
      }),
    ).toBeNull();
  });
});
