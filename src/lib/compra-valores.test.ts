import { describe, expect, it } from "vitest";
import {
  factorCompra,
  ofertaCompraVigente,
  sugerirPrecioCompra,
} from "./compra-valores";
import type { OfertaCompra, VarianteCompra } from "./compras-api";

const tinta = (): VarianteCompra => ({
  id: "tinta",
  nombreVariante: "Cian",
  atributosVarianteJson: {},
  unidadCompra: "LITRO",
  unidadStock: "ML",
  proveedorReferenciaId: "p",
  materiaPrima: {
    nombre: "Tinta UV",
    unidadCompra: "LITRO",
    unidadStock: "ML",
  },
  precioReferencia: 10,
  moneda: "ARS",
  ofertasCompra: [],
  contextoUnidades: {
    unidadCompra: "LITRO",
    unidadStock: "ML",
    unidadPrecio: "ML",
    templateId: "tinta_impresion_v1",
    atributos: { volumenPresentacion: 750 },
  },
});
const oferta = (): OfertaCompra => ({
  id: "oferta",
  varianteId: "tinta",
  proveedorId: "p",
  activo: true,
  unidadCompra: "BOTELLA",
  unidadStock: "ML",
  factorStock: 750,
  precio: 6000,
  moneda: "ARS",
  minimo: 1,
  multiplo: 1,
  reposicionDias: null,
  reposicionTipo: null,
  codigoProveedor: null,
  vigenteHasta: null,
  version: 1,
});
const precio = (
  v: VarianteCompra,
  unidad: string,
  o?: OfertaCompra,
  moneda = "ARS",
) =>
  sugerirPrecioCompra(v, unidad, factorCompra(v, unidad, o), o, moneda, "ARS");
describe("Valores de compra desde datos existentes", () => {
  it("convierte costo por ml a litro y reutiliza el volumen real de la botella", () => {
    const v = tinta();
    expect(factorCompra(v, "LITRO")).toBe(1000);
    expect(factorCompra(v, "BOTELLA")).toBe(750);
    expect(precio(v, "LITRO")).toMatchObject({
      precio: "10000",
      origen: "Costo del inventario",
    });
    expect(precio(v, "BOTELLA").precio).toBe("7500");
  });
  it("prioriza el precio del proveedor y convierte su presentación a otras unidades", () => {
    expect(precio(tinta(), "BOTELLA", oferta()).precio).toBe("6000");
    expect(precio(tinta(), "LITRO", oferta())).toMatchObject({
      precio: "8000",
      origen: "Precio del proveedor",
    });
    expect(precio(tinta(), "ML", oferta()).precio).toBe("8");
  });
  it("recurre al inventario cuando el proveedor no tiene precio", () => {
    expect(
      precio(tinta(), "BOTELLA", { ...oferta(), precio: null }),
    ).toMatchObject({ precio: "7500", origen: "Costo del inventario" });
  });
  it("respeta coeficientes guardados y medidas del material", () => {
    const v = tinta();
    v.contextoUnidades = {
      unidadStock: "HOJA",
      unidadCompra: "RESMA",
      unidadPrecio: "M2",
      templateId: "sustrato_hoja_v1",
      atributos: { ancho: 20, alto: 30 },
      equivalencias: [{ origen: "RESMA", destino: "HOJA", factor: 500 }],
    };
    expect(factorCompra(v, "RESMA")).toBe(500);
    expect(precio(v, "RESMA").precio).toBe("300");
  });
  it("no inventa contenido de cajas ni la unidad de un precio ambiguo", () => {
    const v = tinta();
    expect(factorCompra(v, "CAJA")).toBeNull();
    expect(precio(v, "CAJA").precio).toBe("");
    v.contextoUnidades!.unidadPrecio = null;
    expect(precio(v, "LITRO").aviso).toContain("Confirmá la unidad");
  });
  it("permite calcular el precio al informar un contenido que todavía falta", () => {
    expect(
      sugerirPrecioCompra(tinta(), "CAJA", 3000, undefined, "ARS", "ARS")
        .precio,
    ).toBe("30000");
  });
  it("nunca interpreta dólares como pesos; recupera el importe al elegir su moneda", () => {
    const v = { ...tinta(), moneda: "USD" };
    expect(precio(v, "LITRO").precio).toBe("");
    expect(precio(v, "LITRO").aviso).toContain("USD");
    expect(precio(v, "LITRO", undefined, "USD").precio).toBe("10000");
  });
  it("descarta ofertas vencidas, inactivas o de otro proveedor", () => {
    const v = tinta();
    v.ofertasCompra = [
      { ...oferta(), vigenteHasta: "2020-01-01" },
      { ...oferta(), activo: false },
      { ...oferta(), proveedorId: "otro" },
    ];
    expect(ofertaCompraVigente(v, "p")).toBeUndefined();
    v.ofertasCompra.push(oferta());
    expect(ofertaCompraVigente(v, "p")).toBe(v.ofertasCompra[3]);
  });
});
