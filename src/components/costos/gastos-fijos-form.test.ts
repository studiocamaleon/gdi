import { describe, expect, it } from "vitest";
import { monedaDe } from "@/lib/moneda";
import type { GastoFijo } from "@/lib/gastos-fijos-api";
import {
  calcularVigenteHasta,
  desdeGasto,
  formularioVacio,
  payloadGastoFijo,
  vigenteEnMes,
} from "./gastos-fijos-form";

const moneda = monedaDe("ARS");
const form = {
  ...formularioVacio("alquiler"),
  nombre: "Alquiler",
  valor: "1.234,56",
  vigenteDesde: "2026-09",
};
const gasto: GastoFijo = {
  id: "gasto",
  nombre: "Alquiler",
  categoriaEgresoId: "alquiler",
  categoriaNombre: "Alquiler",
  categoriaCodigo: "alquiler",
  valor: 1234.56,
  importeMensual: 1234.56,
  frecuencia: "MENSUAL",
  proveedorId: null,
  proveedorNombre: null,
  metodoPagoId: null,
  metodoPagoNombre: null,
  documento: null,
  vigenteDesde: "2026-09",
  vigenteHasta: "2026-12",
  activo: false,
  notas: null,
};

describe("Ficha de gastos fijos", () => {
  it("mantiene la generación apagada por defecto y solo envía opt-in al activarla", () => {
    expect(payloadGastoFijo(form, moneda, true).programacion?.activa).toBe(
      false,
    );
    expect(
      payloadGastoFijo(
        {
          ...form,
          generarObligaciones: true,
          generarDesde: "2026-10",
          diaVencimiento: "31",
        },
        moneda,
        true,
      ).programacion,
    ).toEqual({ activa: true, desde: "2026-10", diaVencimiento: 31 });
    expect(
      desdeGasto(
        {
          ...gasto,
          programacion: {
            activa: true,
            desde: "2026-10",
            diaVencimiento: 31,
            cantidad: 1,
            egresosEmitidos: 0,
            ultimoPeriodoGenerado: null,
          },
        },
        moneda,
      ),
    ).toMatchObject({
      generarObligaciones: true,
      generarDesde: "2026-10",
      diaVencimiento: "31",
    });
  });
  it("evita generar obligaciones con importe cero, día inválido o fuera de vigencia", () => {
    const automatico = {
      ...form,
      generarObligaciones: true,
      generarDesde: "2026-09",
    };
    for (const cambio of [
      { valor: "0" },
      { diaVencimiento: "32" },
      { diaVencimiento: "1.5" },
      { generarDesde: "2026-08" },
    ]) {
      expect(() =>
        payloadGastoFijo({ ...automatico, ...cambio }, moneda, true),
      ).toThrow();
    }
    expect(() =>
      payloadGastoFijo(
        {
          ...automatico,
          fin: "en",
          vigenteHasta: "2026-10",
          generarDesde: "2026-11",
        },
        moneda,
        true,
      ),
    ).toThrow();
  });
  it.each([
    ["MENSUAL", "3", "2026-11"],
    ["BIMESTRAL", "3", "2027-02"],
    ["TRIMESTRAL", "2", "2027-02"],
    ["SEMESTRAL", "1", "2027-02"],
    ["ANUAL", "1", "2027-08"],
  ] as const)(
    "resuelve el último mes inclusivo de %s, con %s períodos",
    (frecuencia, repeticiones, hasta) => {
      expect(
        calcularVigenteHasta({
          ...form,
          fin: "despues",
          frecuencia,
          repeticiones,
        }),
      ).toBe(hasta);
    },
  );
  it("no convierte un importe con separadores regionales en cero ni reactiva un gasto", () => {
    const editado = desdeGasto(gasto, moneda);
    const payload = payloadGastoFijo(editado, moneda, gasto.activo);
    expect(editado.valor).toBe("1.234,56");
    expect(payload.valor).toBe(1234.56);
    expect(payload.activo).toBe(false);
    expect(payload.vigenteHasta).toBe("2026-12");
  });
  it("admite gastos sin fin y sin proveedor", () => {
    expect(payloadGastoFijo(form, moneda, true)).toMatchObject({
      vigenteHasta: null,
      proveedorId: null,
      activo: true,
    });
  });
  it("rechaza importes inválidos y vigencias incompletas o invertidas", () => {
    expect(() =>
      payloadGastoFijo({ ...form, valor: "abc" }, moneda, true),
    ).toThrow();
    expect(() =>
      payloadGastoFijo({ ...form, valor: "-10" }, moneda, true),
    ).toThrow();
    expect(() =>
      payloadGastoFijo(
        { ...form, fin: "en", vigenteHasta: "2026-08" },
        moneda,
        true,
      ),
    ).toThrow();
    expect(() =>
      payloadGastoFijo(
        { ...form, fin: "despues", repeticiones: "1.5" },
        moneda,
        true,
      ),
    ).toThrow();
    expect(() =>
      payloadGastoFijo(
        { ...form, fin: "despues", repeticiones: "" },
        moneda,
        true,
      ),
    ).toThrow();
  });
  it("incluye ambos extremos de la vigencia y excluye inactivos del resumen mensual", () => {
    const activo = { ...gasto, activo: true };
    expect(vigenteEnMes(activo, "2026-09")).toBe(true);
    expect(vigenteEnMes(activo, "2026-12")).toBe(true);
    expect(vigenteEnMes(activo, "2026-08")).toBe(false);
    expect(vigenteEnMes(activo, "2027-01")).toBe(false);
    expect(vigenteEnMes(gasto, "2026-09")).toBe(false);
  });
});
