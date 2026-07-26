import { describe, expect, it } from "vitest";

import { normalizarMontoTexto } from "./money-input";
import { monedaDe } from "@/lib/moneda";

// La misma matriz que moneda.test.ts: ARS (coma decimal), CLP (cero
// decimales) y HNL (punto decimal). Los separadores exactos los decide ICU,
// así que se compara contra el propio Intl.
const ARS = monedaDe("ARS");
const CLP = monedaDe("CLP");
const HNL = monedaDe("HNL");

const num = (locale: string, v: number, d: number) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);

describe("normalizarMontoTexto (el blur del MoneyInput)", () => {
  it("ARS: completa separadores de miles y los 2 decimales", () => {
    expect(normalizarMontoTexto("1234,5", ARS)).toBe(num("es-AR", 1234.5, 2));
    expect(normalizarMontoTexto("1.234,56", ARS)).toBe(num("es-AR", 1234.56, 2));
  });

  it("HNL: entiende el punto decimal y agrupa con coma", () => {
    expect(normalizarMontoTexto("1234.5", HNL)).toBe(num("es-HN", 1234.5, 2));
  });

  it("CLP: sin centavos, ni tipeados a propósito", () => {
    expect(normalizarMontoTexto("1234,4", CLP)).toBe(num("es-CL", 1234, 0));
    expect(normalizarMontoTexto("1.500", CLP)).toBe(num("es-CL", 1500, 0));
  });

  it("es idempotente: normalizar lo ya normalizado no lo cambia", () => {
    const una = normalizarMontoTexto("1234,56", ARS);
    expect(normalizarMontoTexto(una, ARS)).toBe(una);
  });

  it("texto inválido o vacío queda tal cual, para que el usuario lo vea", () => {
    expect(normalizarMontoTexto("abc", ARS)).toBe("abc");
    expect(normalizarMontoTexto("1.2.3,4,5", ARS)).toBe("1.2.3,4,5");
    expect(normalizarMontoTexto("", ARS)).toBe("");
  });
});
