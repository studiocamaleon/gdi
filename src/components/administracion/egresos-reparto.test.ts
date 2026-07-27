import { describe, expect, it } from "vitest";

import { repartirEntreEgresos } from "./egresos-view";

/**
 * Cómo se reparte un cheque entre varias facturas.
 *
 * El caso que lo motivó: factura de 300.000 y cheque de 200.000. No es un
 * cheque partido —eso no existe—: es un pago parcial de 200.000 y el resto se
 * paga después por otro medio. Lo que este reparto tiene que garantizar es que
 * la suma dé EXACTAMENTE lo del cheque y que ningún egreso reciba más que su
 * saldo; cualquiera de las dos cosas mal deja plata mal imputada.
 */

const suma = (r: Record<string, number>) =>
  Object.values(r).reduce((a, b) => a + b, 0);

describe("repartir un cheque entre facturas", () => {
  it("una factura más grande que el cheque: paga lo que cubre", () => {
    const r = repartirEntreEgresos([{ id: "a", saldo: 300_000 }], 200_000);
    expect(r).toEqual({ a: 200_000 });
  });

  it("varias facturas: cancela de arriba hacia abajo hasta agotarse", () => {
    const r = repartirEntreEgresos(
      [
        { id: "a", saldo: 120_000 },
        { id: "b", saldo: 100_000 },
        { id: "c", saldo: 50_000 },
      ],
      200_000,
    );
    expect(r).toEqual({ a: 120_000, b: 80_000, c: 0 });
    expect(suma(r)).toBe(200_000);
  });

  /** Nunca se paga de más, aunque el cheque sobre. */
  it("un cheque más grande que todo deja cada egreso en su saldo", () => {
    const r = repartirEntreEgresos(
      [
        { id: "a", saldo: 10_000 },
        { id: "b", saldo: 5_000 },
      ],
      999_999,
    );
    expect(r).toEqual({ a: 10_000, b: 5_000 });
    expect(suma(r)).toBe(15_000);
  });

  it("el que se queda sin cheque recibe cero, no queda sin clave", () => {
    const r = repartirEntreEgresos(
      [
        { id: "a", saldo: 100 },
        { id: "b", saldo: 100 },
      ],
      50,
    );
    expect(r).toEqual({ a: 50, b: 0 });
    expect(Object.keys(r)).toEqual(["a", "b"]);
  });

  /**
   * Los centavos: restar flotantes en cadena deja residuos como
   * 0.009999999 que se convertirían en un centavo asignado de más.
   */
  it("con centavos la suma cierra exacta", () => {
    const r = repartirEntreEgresos(
      [
        { id: "a", saldo: 33.33 },
        { id: "b", saldo: 33.33 },
        { id: "c", saldo: 33.34 },
      ],
      100,
    );
    expect(suma(r)).toBe(100);
    expect(r.c).toBe(33.34);
  });

  it("un cheque de cero no asigna nada", () => {
    const r = repartirEntreEgresos([{ id: "a", saldo: 100 }], 0);
    expect(r).toEqual({ a: 0 });
  });

  /** Defensivo: un importe negativo no puede generar imputaciones negativas. */
  it("un importe negativo se trata como cero", () => {
    const r = repartirEntreEgresos([{ id: "a", saldo: 100 }], -50);
    expect(r).toEqual({ a: 0 });
  });

  it("sin egresos devuelve vacío, no rompe", () => {
    expect(repartirEntreEgresos([], 100)).toEqual({});
  });
});
