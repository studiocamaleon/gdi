import { describe, expect, it } from "vitest";

import {
  abreviarMoneda,
  formatearMoneda,
  formatearMonedaDoc,
  monedaDe,
  numeroMoneda,
  parsearMonto,
} from "./moneda";

// Los tres casos de la matriz inicial: ARS (2 dec, coma decimal), CLP (CERO
// decimales — el caso que rompe todo lo asumido) y HNL (2 dec, PUNTO decimal
// estilo en-US). Ver docs/multi-moneda-zona-horaria-diseno.md.
const ARS = monedaDe("ARS");
const CLP = monedaDe("CLP");
const HNL = monedaDe("HNL");

// Los separadores exactos los decide ICU y pueden variar entre versiones de
// Node; comparar contra el propio Intl mantiene el test estable sin dejar de
// fijar lo que importa (decimales, símbolo, orden).
const num = (locale: string, v: number, d: number) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);

describe("numeroMoneda", () => {
  it("ARS lleva 2 decimales y separadores es-AR", () => {
    expect(numeroMoneda(1234.5, ARS)).toBe(num("es-AR", 1234.5, 2));
  });

  it("CLP no tiene centavos: redondea a la unidad", () => {
    expect(numeroMoneda(1234.56, CLP)).toBe(num("es-CL", 1234.56, 0));
    expect(numeroMoneda(1234.56, CLP)).not.toContain(",");
  });

  it("HNL agrupa al estilo en-US (1,234.56)", () => {
    expect(numeroMoneda(1234.56, HNL)).toBe(num("es-HN", 1234.56, 2));
  });

  it("el override de decimales pisa los de la moneda (KPIs enteros)", () => {
    expect(numeroMoneda(1234.56, ARS, 0)).toBe(num("es-AR", 1234.56, 0));
  });
});

describe("formatearMoneda / formatearMonedaDoc", () => {
  it("pantalla usa el símbolo local", () => {
    expect(formatearMoneda(1000, ARS)).toBe(`$ ${num("es-AR", 1000, 2)}`);
    expect(formatearMoneda(1000, HNL)).toBe(`L ${num("es-HN", 1000, 2)}`);
  });

  it("documentos desambiguan el $ compartido", () => {
    expect(formatearMonedaDoc(1000, ARS)).toMatch(/^AR\$/);
    expect(formatearMonedaDoc(1000, CLP)).toMatch(/^CLP \$/);
    expect(formatearMonedaDoc(1000, monedaDe("USD"))).toMatch(/^US\$/);
  });

  it("una moneda desconocida cae a ARS, nunca revienta", () => {
    expect(formatearMoneda(10, monedaDe("XXX"))).toBe(
      `$ ${num("es-AR", 10, 2)}`,
    );
  });
});

describe("abreviarMoneda", () => {
  it("millones y miles con el símbolo de la moneda", () => {
    expect(abreviarMoneda(1_250_000, ARS)).toBe(`$ ${num("es-AR", 1.25, 1)}M`);
    expect(abreviarMoneda(850_000, ARS)).toBe(`$ ${num("es-AR", 850, 0)}k`);
    expect(abreviarMoneda(12_500, ARS)).toBe(`$ ${num("es-AR", 12.5, 1)}k`);
    expect(abreviarMoneda(999, CLP)).toBe(`$ ${num("es-CL", 999, 0)}`);
  });
});

describe("parsearMonto", () => {
  it("Argentina: punto agrupa, coma decimal", () => {
    expect(parsearMonto("1.234,56", ARS)).toBe(1234.56);
    expect(parsearMonto("1234,5", ARS)).toBe(1234.5);
  });

  it("Honduras: coma agrupa, punto decimal", () => {
    expect(parsearMonto("1,234.56", HNL)).toBe(1234.56);
  });

  it("CLP redondea lo tipeado a la unidad: los centavos no existen", () => {
    expect(parsearMonto("1.234", CLP)).toBe(1234);
    expect(parsearMonto("1234,4", CLP)).toBe(1234);
  });

  it("basura → null, no NaN", () => {
    expect(parsearMonto("abc", ARS)).toBeNull();
    expect(parsearMonto("", ARS)).toBeNull();
    expect(parsearMonto("1.2.3,4,5", ARS)).toBeNull();
  });

  it("negativo válido (ajustes, notas de crédito)", () => {
    expect(parsearMonto("-500,25", ARS)).toBe(-500.25);
  });
});
