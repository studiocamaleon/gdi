import { describe, expect, it } from "vitest";

import { opcionesDeCuentas } from "./egresos-view";
import type { CuentaFondosResumen } from "@/lib/administracion";

/**
 * De qué cuenta sale la plata, según el método de pago.
 *
 * La regla que fija este test: el método SUGIERE la cuenta, no la impone.
 * `MetodoPago.cuentaDestinoId` es una cuenta por defecto, no una lista de
 * cuentas habilitadas, y en el tenant real 7 de los 9 métodos la tienen
 * vacía: filtrar por ella dejaría el selector sin opciones y el formulario
 * sin poder guardarse. Sugerir siempre deja algo para elegir.
 */

const cuenta = (id: string, nombre: string, moneda = "ARS") =>
  ({ id, nombre, moneda }) as CuentaFondosResumen;

const CUENTAS = [
  cuenta("1", "Caja mostrador"),
  cuenta("2", "Cartera de valores"),
  cuenta("3", "Banco Nación USD", "USD"),
];

describe("las cuentas que se ofrecen para pagar", () => {
  it("sin cuenta del método se ofrecen todas, en su orden", () => {
    const o = opcionesDeCuentas(CUENTAS, null);
    expect(o.map((x) => x.label)).toEqual([
      "Caja mostrador",
      "Cartera de valores",
      "Banco Nación USD",
    ]);
  });

  /** El caso de 7 de los 9 métodos del tenant: no hay nada configurado. */
  it("sin cuenta del método NO se esconde ninguna", () => {
    expect(opcionesDeCuentas(CUENTAS, undefined)).toHaveLength(CUENTAS.length);
  });

  it("la cuenta del método va primera", () => {
    const o = opcionesDeCuentas(CUENTAS, "2");
    expect(o[0].label).toBe("Cartera de valores");
  });

  /** Que esté primera no puede costarle el lugar a ninguna otra. */
  it("las demás siguen estando, y una sola vez", () => {
    const o = opcionesDeCuentas(CUENTAS, "2");
    expect(o).toHaveLength(3);
    expect(new Set(o.map((x) => x.value)).size).toBe(3);
    expect(o.map((x) => x.label)).toContain("Caja mostrador");
  });

  /** El detalle explica por qué esa está arriba; el resto muestra su moneda. */
  it("la sugerida se marca y las otras conservan la moneda", () => {
    const o = opcionesDeCuentas(CUENTAS, "2");
    expect(o[0].detalle).toContain("la del método elegido");
    expect(o.find((x) => x.value === "3")?.detalle).toBe("USD");
  });

  /** Un método que apunta a una cuenta dada de baja no rompe la lista. */
  it("una cuenta del método que ya no existe no altera nada", () => {
    const o = opcionesDeCuentas(CUENTAS, "999");
    expect(o.map((x) => x.label)).toEqual([
      "Caja mostrador",
      "Cartera de valores",
      "Banco Nación USD",
    ]);
    expect(o.every((x) => !x.detalle?.includes("método"))).toBe(true);
  });

  it("sin cuentas cargadas devuelve vacío, no rompe", () => {
    expect(opcionesDeCuentas([], "1")).toEqual([]);
  });
});
