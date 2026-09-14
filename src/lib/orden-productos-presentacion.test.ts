import { describe, expect, it } from "vitest";
import { productoDiseno } from "@/components/comercial/__fixtures__/orden-diseno";
import {
  calcularResumenOrden,
  descuentoMontoDeItem,
  formatCantidadItem,
  getItemOrderVisibleAmounts,
} from "./orden-productos-presentacion";
import type { PropuestaCargoDirecto, PropuestaItem } from "./propuestas";

function conDesglose(): PropuestaItem {
  const item = productoDiseno("p1", "Impresión", 10, 1000);
  item.cotizacion.desglosePrecio = {
    precioConfig: { metodoCalculo: "FIJO", detalle: {} },
    impuestos: [
      {
        catalogoId: "iva",
        codigo: "IVA",
        nombre: "IVA",
        porcentaje: 21,
        orden: 0,
        traslado: "POR_FUERA",
        desglosarCliente: true,
      },
      {
        catalogoId: "iibb",
        codigo: "IIBB",
        nombre: "Ingresos brutos",
        porcentaje: 3,
        orden: 1,
        traslado: "POR_DENTRO",
        desglosarCliente: false,
      },
    ],
    comisiones: [],
    precioEspecialCliente: null,
    precioBase: 100,
    totalComisiones: 0,
    totalImpuestos: 21,
    margenEfectivoPct: 40,
    precioNetoUnitario: 100,
    precioBrutoUnitario: 121,
    precioNetoTotal: 1000,
    precioBrutoTotal: 1210,
    descuento: {
      aplicado: true,
      montoUnitario: 10,
      montoTotal: 100,
      netoListaUnitario: 110,
      netoListaTotal: 1100,
    },
  };
  return item;
}

describe("importes de presentación de la orden", () => {
  it("mantiene los snapshots antiguos sin desglose", () => {
    expect(
      getItemOrderVisibleAmounts(productoDiseno("p", "Producto", 10, 1000)),
    ).toEqual({ subtotal: 1000, impuestos: 210, total: 1210 });
  });

  it("no duplica impuestos internos ni descuenta por segunda vez", () => {
    const item = conDesglose();
    const original = structuredClone(item);
    expect(getItemOrderVisibleAmounts(item)).toEqual({
      subtotal: 1000,
      impuestos: 210,
      total: 1210,
    });
    expect(descuentoMontoDeItem(item)).toBe(100);
    expect(item).toEqual(original);
  });

  it("incorpora al subtotal el impuesto externo oculto sin cambiar el total", () => {
    const item = conDesglose();
    item.cotizacion.desglosePrecio!.impuestos[0].desglosarCliente = false;
    expect(getItemOrderVisibleAmounts(item)).toEqual({
      subtotal: 1210,
      impuestos: 0,
      total: 1210,
    });
  });

  it("agrega cargos de la orden una sola vez y conserva la colección comercial", () => {
    const items = [conDesglose(), productoDiseno("p2", "Otro", 5, 2000)];
    const cargo: PropuestaCargoDirecto = {
      id: "c",
      cargoDirectoCatalogoId: "envio",
      codigoSnapshot: "ENV",
      nombreSnapshot: "Envío",
      modoCalculoSnapshot: "MONTO_FIJO_PLANO",
      configSnapshot: {},
      baseCalculo: 100,
      montoNeto: 100,
      impuestoPorcentaje: 21,
      impuestoMonto: 21,
      total: 121,
      detalle: "",
      createdAt: "2026-09-12T12:00:00Z",
    };
    expect(calcularResumenOrden(items, [cargo])).toMatchObject({
      subtotal: 3100,
      impuestos: 651,
      total: 3751,
      cantidadItems: 2,
    });
    expect(items.map((i) => i.id)).toEqual(["p1", "p2"]);
  });

  it("conserva los decimales de superficie y longitud", () => {
    const item = productoDiseno("p", "Lona", 2.75, 1000);
    item.unidadMedida = "m2";
    expect(formatCantidadItem(item)).toBe("2,75");
    item.unidadMedida = "metro_lineal";
    expect(formatCantidadItem(item)).toBe("2,75");
  });
});
