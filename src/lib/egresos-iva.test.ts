import { describe, expect, it } from "vitest";

import {
  ALICUOTAS_IVA,
  LARGO_NUMERO_COMPROBANTE,
  LARGO_PUNTO_VENTA,
  TIPOS_COMPROBANTE_COMPRA,
  completarCeros,
  discriminaIva,
  ivaDeNeto,
} from "./egresos";

/**
 * Qué comprobante lleva IVA aparte, y cuánto.
 *
 * Un error acá no se ve en pantalla: se ve meses después, cuando el Libro IVA
 * Compras reclama un crédito fiscal que ningún comprobante respalda. Por eso
 * la lista está fijada de las dos formas —lo que discrimina y lo que no—: si
 * mañana alguien agrega un tipo nuevo, el test lo obliga a decidir.
 */

describe("qué comprobantes discriminan IVA", () => {
  /** Es la única que habilita el crédito fiscal. */
  it("la Factura A sí", () => {
    expect(discriminaIva("FA")).toBe(true);
  });

  /** Ajustan una Factura A, así que arrastran su IVA. */
  it("las notas de crédito y débito sí", () => {
    expect(discriminaIva("ND")).toBe(true);
    expect(discriminaIva("NC")).toBe(true);
  });

  /**
   * La B trae el IVA ADENTRO del precio y sin discriminar, y la C —de un
   * monotributista— directamente no tiene. Para el que compra, el importe es
   * el importe.
   */
  it("las facturas B y C no", () => {
    expect(discriminaIva("FB")).toBe(false);
    expect(discriminaIva("FC")).toBe(false);
  });

  it("el ticket, el recibo y el gasto sin papel tampoco", () => {
    expect(discriminaIva("TICKET")).toBe(false);
    expect(discriminaIva("RECIBO")).toBe(false);
    expect(discriminaIva("SIN_DOCUMENTO")).toBe(false);
  });

  it("un tipo desconocido o vacío no discrimina", () => {
    expect(discriminaIva(null)).toBe(false);
    expect(discriminaIva(undefined)).toBe(false);
    expect(discriminaIva("CUALQUIERA")).toBe(false);
  });

  /** Un tipo nuevo en el catálogo tiene que pasar por esta decisión. */
  it("los que discriminan son exactamente tres del catálogo", () => {
    expect(TIPOS_COMPROBANTE_COMPRA.filter(discriminaIva)).toEqual([
      "FA",
      "ND",
      "NC",
    ]);
  });
});

describe("el IVA que sale de la alícuota", () => {
  it("21% de 100.000", () => {
    expect(ivaDeNeto(100_000, 21)).toBe(21_000);
  });

  /** La alícuota con decimales es la que rompe si se redondea mal. */
  it("10,5% redondea a centavos", () => {
    expect(ivaDeNeto(1234.55, 10.5)).toBe(129.63);
  });

  it("27% (servicios) y 2,5%", () => {
    expect(ivaDeNeto(1000, 27)).toBe(270);
    expect(ivaDeNeto(1000, 2.5)).toBe(25);
  });

  /** Exento cargado con alícuota 0: el total es el neto. */
  it("0% da cero", () => {
    expect(ivaDeNeto(999_999, 0)).toBe(0);
  });

  it("sin importe no hay IVA", () => {
    expect(ivaDeNeto(0, 21)).toBe(0);
  });

  /**
   * Ninguna alícuota puede dar un número con más de dos decimales: el total
   * termina en un asiento y en un pago.
   */
  it("ninguna alícuota deja más de dos decimales", () => {
    for (const a of ALICUOTAS_IVA) {
      for (const neto of [1234.55, 87.31, 19_999.99, 3.33]) {
        const iva = ivaDeNeto(neto, a);
        // Contra `toFixed` y no contra `iva * 100`: multiplicar por 100 vuelve
        // a meter el error de flotante que la función justamente saca
        // (2,18 × 100 da 218,00000000000003).
        expect(iva).toBe(Number(iva.toFixed(2)));
      }
    }
  });
});

/**
 * Los ceros del comprobante.
 *
 * No es cosmética: el único de la base es
 * (proveedor, tipo, puntoVenta, numero), así que si la misma factura entra
 * una vez como "1"/"12345" y otra como "0001"/"00012345", el antiduplicado
 * no la ve y el proveedor queda con la deuda cargada dos veces.
 */
describe("completar los ceros del comprobante", () => {
  it("el punto de venta va a cuatro dígitos", () => {
    expect(completarCeros("1", LARGO_PUNTO_VENTA)).toBe("0001");
    expect(completarCeros("23", LARGO_PUNTO_VENTA)).toBe("0023");
  });

  it("el número va a ocho", () => {
    expect(completarCeros("12345", LARGO_NUMERO_COMPROBANTE)).toBe("00012345");
    expect(completarCeros("1", LARGO_NUMERO_COMPROBANTE)).toBe("00000001");
  });

  it("lo que ya viene completo queda igual", () => {
    expect(completarCeros("0001", LARGO_PUNTO_VENTA)).toBe("0001");
    expect(completarCeros("00012345", LARGO_NUMERO_COMPROBANTE)).toBe(
      "00012345",
    );
  });

  /** Las dos formas de escribir la misma factura terminan siendo una sola. */
  it("'1' y '0001' terminan idénticos", () => {
    expect(completarCeros("1", LARGO_PUNTO_VENTA)).toBe(
      completarCeros("0001", LARGO_PUNTO_VENTA),
    );
  });

  it("los espacios de más no cuentan", () => {
    expect(completarCeros("  7  ", LARGO_PUNTO_VENTA)).toBe("0007");
  });

  it("el campo vacío queda vacío, no '0000'", () => {
    expect(completarCeros("", LARGO_PUNTO_VENTA)).toBe("");
    expect(completarCeros("   ", LARGO_PUNTO_VENTA)).toBe("");
  });

  /**
   * Lo que no es sólo dígitos se respeta: si pegaron el comprobante entero o
   * una letra, deformarlo escondería el error en vez de mostrarlo.
   */
  it("lo que no son sólo dígitos se deja intacto", () => {
    expect(completarCeros("0001-00012345", LARGO_PUNTO_VENTA)).toBe(
      "0001-00012345",
    );
    expect(completarCeros("A1", LARGO_PUNTO_VENTA)).toBe("A1");
  });

  /** Más largo que el formato: es un dato raro, pero no se trunca. */
  it("lo más largo que el formato no se corta", () => {
    expect(completarCeros("123456", LARGO_PUNTO_VENTA)).toBe("123456");
  });
});
