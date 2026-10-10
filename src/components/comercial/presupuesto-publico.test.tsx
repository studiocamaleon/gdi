import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PresupuestoPublico } from "@/lib/presupuestos-api";
import { PresupuestoPublicoView } from "./presupuesto-publico";

const inicial: PresupuestoPublico = {
  numero: "PRES-1",
  estado: "enviado",
  negocio: "Imprenta",
  cliente: "Cliente",
  vendedor: null,
  fechaEmision: "2026-10-08",
  fechaValidez: "2026-10-23",
  observaciones: null,
  senaSugeridaPct: null,
  subtotal: 1000,
  impuestos: 210,
  cargosDirectos: 955900,
  total: 957110,
  descuentoTotal: 0,
  fidelizacion: {
    puntosEstimados: 0, canjePuntos: 0, canjeMonto: 0, condicion: "",
  },
  items: [{
    nombre: "Vinilo", cantidad: 1, cantidadUnidad: "u.",
    total: 1210, specs: [], adicionales: [],
  }],
};

describe("detalle público de cargos", () => {
  it("muestra cada concepto e importe dentro del detalle antes del resumen", () => {
    const html = renderToStaticMarkup(<PresupuestoPublicoView token="prueba" initial={{
      ...inicial,
      cargos: [
        { nombre: "Instalación", descripcion: "Colocación en el local", total: 955000 },
        { nombre: "Traslado", descripcion: null, total: 900 },
      ],
    }} />);
    const detalle = html.slice(html.indexOf("Detalle del trabajo"), html.indexOf(">Resumen<"));
    expect(detalle).toContain("1 producto · 2 cargos");
    expect(detalle).toContain("Instalación");
    expect(detalle).toContain("Colocación en el local");
    expect(detalle).toContain("955.000");
    expect(detalle).toContain("Traslado");
    expect(detalle).toContain("900");
  });

  it("omite filas de cargos si no hay desglose", () => {
    const html = renderToStaticMarkup(<PresupuestoPublicoView token="prueba" initial={{ ...inicial, cargosDirectos: 0 }} />);
    expect(html).not.toContain("Cargo adicional");
    expect(html).toContain("1 producto");
  });
});
