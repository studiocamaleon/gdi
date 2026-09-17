import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import type { CuentaCorriente } from "@/lib/administracion";
import { CuentaCorrienteView } from "./cuenta-corriente-view";

const cuenta: CuentaCorriente = {
  cliente: { id: "cliente", nombre: "Cliente", razonSocial: null, cuit: null, condicionFiscal: "CF", limiteCredito: null, plazoCuentaCorrienteDias: null, vendedor: null },
  saldo: 10431,
  anticipoDisponible: 0,
  sinVencimiento: 0,
  comprobantesPendientes: 3,
  usoLimitePct: null,
  excedido: false,
  excedente: 0,
  aging: { a_vencer: 0, d0_30: 10431, d31_60: 0, d61_90: 0, d90_mas: 0 },
  agingTotal: 10431,
  movimientos: [
    { id: "cobro", fecha: "2026-09-16", tipo: "cobro", sigla: "COB", descripcion: "Cobro OT-2026-0059", debe: 0, haber: 35086.21, saldo: 10431 },
    { id: "ot59", fecha: "2026-09-11", tipo: "orden", sigla: "OT", descripcion: "Orden OT-2026-0059", debe: 35086.21, haber: 0, saldo: 45517.21 },
  ],
};
const render = (cc: CuentaCorriente) => renderToStaticMarkup(
  <DesignSystemProvider theme="brand" appearance="light"><CuentaCorrienteView cc={cc} /></DesignSystemProvider>,
);

describe("Cuenta corriente · saldo total y vencido", () => {
  it("muestra cargos y pagos con el saldo final coherente con el resumen, sin reservas", () => {
    const html = render(cuenta);
    expect(html).toContain("Saldo total");
    expect(html).toContain("Saldo vencido");
    expect(html).not.toContain("Saldo disponible a favor");
    expect(html).toContain("10.431,00");
    expect(html).toContain("Ver vencimientos");
    expect(html).toContain("Orden OT-2026-0059");
    expect(html).toContain("Cobro OT-2026-0059");
    expect(html).toMatch(/−\s*\$\s*35\.086,21/);
    expect(html).toMatch(/\+\s*\$\s*35\.086,21/);
    expect(html).toMatch(/data-balance="debe"[^>]*>−\s*\$\s*10\.431,00/);
    for (const titulo of ["Cargos", "Pagos y créditos", "Saldo"]) {
      expect(html).toMatch(new RegExp(`<th\\b[^>]*>${titulo}</th>`));
    }
    expect(html).not.toContain("reserva");
    expect(html).not.toContain("Saldo global");
  });
  it("presenta el saldo total a favor en positivo y sin deuda vencida", () => {
    const html = render({ ...cuenta, anticipoDisponible: 125.37, saldo: -125.37, aging: { a_vencer: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_mas: 0 }, agingTotal: 0, comprobantesPendientes: 0 });
    expect(html.split("<details")[0]).toMatch(/\+\s*\$\s*125,37/);
    expect(html).toContain("Saldo a favor del cliente.");
    expect(html).toContain("No hay pagos vencidos.");
    expect(html).not.toContain("Ver vencimientos");
    expect(html).not.toContain("35.125");
  });
  it("muestra el neto del extracto y suma todos los tramos vencidos, excluyendo a vencer", () => {
    const html = render({ ...cuenta, saldo: 9000, anticipoDisponible: 1000,
      aging: { a_vencer: 9898.90, d0_30: 10.11, d31_60: 20.22, d61_90: 30.33, d90_mas: 40.44 }, agingTotal: 10000,
    });
    const resumen = html.split("<details")[0];
    expect(resumen).toMatch(/−\s*\$\s*9\.000,00/);
    expect(resumen).toMatch(/−\s*\$\s*101,10/);
    expect(resumen).not.toContain("10.000,00");
    expect(resumen).not.toContain("9.898,90");
  });
  it("mantiene acceso al detalle con deuda a vencer aunque el vencido sea cero", () => {
    const html = render({ ...cuenta, saldo: 800, sinVencimiento: 800,
      aging: { a_vencer: 800, d0_30: 0, d31_60: 0, d61_90: 0, d90_mas: 0 }, agingTotal: 800,
    });
    const resumen = html.split("<details")[0];
    expect(resumen).toMatch(/−\s*\$\s*800,00/);
    expect(resumen).toContain("No hay pagos vencidos.");
    expect(resumen).toContain("Ver vencimientos");
    expect(resumen).not.toMatch(/−\s*\$\s*0,00/);
  });
  it("resta cargos, suma pagos y muestra deuda negativa hasta saldar la cuenta", () => {
    const html = render({ ...cuenta, movimientos: [
      { id: "cargo", fecha: "2026-09-14", tipo: "orden", sigla: "OT", descripcion: "Cargo de prueba", debe: 100.25, haber: 0, saldo: 100.25 },
      { id: "parcial", fecha: "2026-09-15", tipo: "cobro", sigla: "COB", descripcion: "Pago parcial", debe: 0, haber: 30.10, saldo: 70.15 },
      { id: "final", fecha: "2026-09-16", tipo: "cobro", sigla: "COB", descripcion: "Pago final", debe: 0, haber: 70.15, saldo: 0 },
    ] });
    const filas = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    const cargo = filas.find((fila) => fila.includes("Cargo de prueba"))!;
    const parcial = filas.find((fila) => fila.includes("Pago parcial"))!;
    const final = filas.find((fila) => fila.includes("Pago final"))!;
    expect(cargo.match(/−\s*\$\s*100,25/g)).toHaveLength(2);
    expect(parcial).toMatch(/\+\s*\$\s*30,10/);
    expect(parcial).toMatch(/data-balance="debe"[^>]*>−\s*\$\s*70,15/);
    expect(final).toMatch(/data-balance="cero"[^>]*>\$\s*0,00/);
  });
  it("explica que el cargo aparece desde la emisión cuando aún no hay movimientos", () => {
    const html = render({ ...cuenta, movimientos: [], saldo: 0, anticipoDisponible: 0, agingTotal: 0,
      aging: { a_vencer: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_mas: 0 }, comprobantesPendientes: 0 });
    expect(html).toContain("Cuando se emita una orden");
    expect(html).not.toContain("Cuando se finalice");
    expect(html).toContain("Saldo total en cero.");
    expect(html).not.toMatch(/[−+]\s*\$\s*0,00/);
  });
});
