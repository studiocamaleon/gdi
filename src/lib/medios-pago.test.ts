import { describe, it, expect } from "vitest";
import { reconciliarComisionPasarela } from "./costos-orden";
import {
  calcularRetenciones,
  cifrasCobro,
  estimarAcreditacion,
  type ReglaRetencion,
} from "../../apps/api/src/common/medios-pago";
import { simularMetodo, plazoAcreditacionLabel } from "./administracion";
const regla: ReglaRetencion = {
  id: "00000000-0000-4000-8000-000000000001",
  regimen: "SIRTAC",
  jurisdiccion: "Provincia de prueba",
  agente: "procesador",
  alicuota: 3.5,
  baseCalculo: "neto_liquidacion",
};

describe("Medios de pago: dinero disponible e impuestos separados", () => {
  it("calcula la retención sobre la liquidación, con centavos y sin otro descuento de IIBB", () => {
    const sim = simularMetodo(
      {
        comisionPct: 1,
        ivaComisionPct: 21,
        sufreRetencion: true,
        retencionesConfig: [regla],
      },
      100000,
      "2026-10-01",
    );
    expect(sim.comision).toBe(1000);
    expect(sim.ivaComision).toBe(210);
    expect(sim.retenciones[0].base).toBe(98790);
    expect(sim.retencionesTotal).toBe(3457.65);
    expect(sim.disponible).toBe(95332.35);
    expect(cifrasCobro(100000, 1, 21, 3458).disponibleReal).toBe(95332);
  });
  it("no aplica reglas apagadas ni fuera de vigencia", () => {
    const metodo = {
      comisionPct: 0,
      ivaComisionPct: 0,
      retencionesConfig: [{ ...regla, vigenteDesde: "2026-11-01" }],
    };
    expect(
      simularMetodo({ ...metodo, sufreRetencion: true }, 1000, "2026-10-01")
        .retencionesTotal,
    ).toBe(0);
    expect(
      simularMetodo({ ...metodo, sufreRetencion: false }, 1000, "2026-12-01")
        .retencionesTotal,
    ).toBe(0);
  });
  it("cambia la base sin encadenar ni duplicar descuentos", () => {
    const ret = calcularRetenciones(
      [
        { ...regla, baseCalculo: "bruto" },
        { ...regla, id: "2", regimen: "SICORE_GANANCIAS", alicuota: 1 },
      ],
      100000,
      98790,
      "2026-10-01",
    );
    expect(ret.map((r) => r.monto)).toEqual([3500, 987.9]);
  });
  it("actualiza proporciones en un pago parcial y conserva centavos", () => {
    expect(
      calcularRetenciones([regla], 50000, 49395, "2026-10-01")[0].monto,
    ).toBe(1728.83);
    expect(cifrasCobro(100.55, 1, 21, 0)).toEqual({
      comisionMonto: 1.01,
      comisionIvaMonto: 0.21,
      netoAcreditado: 99.33,
      disponibleReal: 99.33,
    });
  });
});

it("la retención no reduce otra vez el margen al reconciliar el costo de cobro", () => {
  const cobros = [
    {
      montoBruto: 100000,
      comisionMonto: 1000,
      retencionesTotal: 3458,
      disponibleReal: 95332,
    },
  ];
  const r = reconciliarComisionPasarela({
    comisionPasarelaEstimada: 1000,
    margenMonto: 25000,
    precioNeto: 100000,
    totalOrden: 100000,
    cobros,
  });
  expect(r.margenAjustadoMonto).toBe(25000);
  expect(r.saldada).toBe(true);
});

describe("Acreditaciones: calendario bancario", () => {
  it("viernes más un hábil saltea fin de semana y feriado del lunes", () => {
    expect(estimarAcreditacion("2026-10-09", 1).fecha).toBe("2026-10-13");
    expect(estimarAcreditacion("2026-10-09", 1, "corridos").fecha).toBe(
      "2026-10-10",
    );
  });
  it("contempla feriados consecutivos y adicionales del proveedor", () => {
    expect(estimarAcreditacion("2026-04-01", 1).fecha).toBe("2026-04-06");
    expect(
      estimarAcreditacion("2026-11-05", 1, "habiles_bancarios", "AR", [
        "2026-11-06",
      ]).fecha,
    ).toBe("2026-11-09");
  });
  it("no aplica feriados argentinos a otra jurisdicción ni promete años sin calendario", () => {
    expect(
      estimarAcreditacion("2026-10-09", 1, "habiles_bancarios", "CL"),
    ).toMatchObject({ fecha: "2026-10-12", calendarioCompleto: false });
    expect(estimarAcreditacion("2026-12-31", 1).advertencia).toBeTruthy();
  });
  it("maneja inmediato, valida fechas imposibles y rotula hábiles/corridos", () => {
    expect(estimarAcreditacion("2026-10-10", 0).fecha).toBe("2026-10-10");
    expect(() => estimarAcreditacion("2026-02-30", 1)).toThrow();
    expect(plazoAcreditacionLabel(3)).toContain("hábiles bancarios");
    expect(plazoAcreditacionLabel(2, "corridos")).toContain("corridos");
  });
});
