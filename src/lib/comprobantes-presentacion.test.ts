import { describe, expect, it } from "vitest";
import { etiquetaSaldoComprobante, fechaComprobante } from "./comprobantes-presentacion";
import { estadoVisual, type Comprobante } from "./administracion";
import { formatearMonedaDoc, monedaDe } from "./moneda";

const comprobante: Comprobante = {
  id: "factura", tipo: "factura", letra: "B", puntoVentaNumero: "0001", numero: 1,
  numeroCompleto: "B 0001-00000001", fecha: "2026-09-01", clienteNombre: "Cliente",
  clienteCuit: null, ordenId: null, ordenNumero: null, ordenes: [], items: [],
  netoGravado: 100, ivaTotal: 21, ivaPorAlicuota: [], total: 121, moneda: "ARS",
  cotizacion: null, estado: "emitido", cae: null, caeVencimiento: null,
  condicionVenta: "contado", vencimiento: null, leyenda: null, rechazo: null,
  saldoPendiente: 0, comprobanteOrigenId: null,
};
const fmt = (n: number) => formatearMonedaDoc(n, monedaDe("USD"));

describe("Presentación de comprobantes", () => {
  it.each(["borrador", "anulado", "rechazado"] as const)("no presenta %s como cobrado aunque su saldo sea cero", (estado) => {
    expect(etiquetaSaldoComprobante({ ...comprobante, estado }, fmt)).toBe("—");
  });
  it("distingue una NC aplicada de una factura corregida y una cobrada", () => {
    expect(etiquetaSaldoComprobante({ ...comprobante, tipo: "nota_credito" }, fmt)).toBe("Aplicada");
    expect(etiquetaSaldoComprobante({ ...comprobante, corregido: true }, fmt)).toBe("Corregido");
    expect(etiquetaSaldoComprobante(comprobante, fmt)).toBe("Cobrado");
  });
  it("conserva moneda y centavos en un saldo pendiente", () => {
    expect(etiquetaSaldoComprobante({ ...comprobante, moneda: "USD", saldoPendiente: 121.55 }, fmt)).toBe("US$ 121,55");
  });
  it("separa emitidos con CAE y sin CAE, conservando anulados", () => {
    expect(estadoVisual(comprobante).clave).toBe("emitido");
    expect(estadoVisual({ ...comprobante, cae: "12345678901234" }).clave).toBe("cae");
    expect(estadoVisual({ ...comprobante, cae: "12345678901234", estado: "anulado" }).clave).toBe("anulado");
  });
  it("no mueve al día anterior una fecha civil del primer día del mes", () => {
    expect(fechaComprobante("2026-09-01")).toBe("01/09/2026");
    expect(fechaComprobante(null)).toBe("—");
  });
});
