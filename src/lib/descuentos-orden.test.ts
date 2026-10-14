import { describe, expect, it } from "vitest";
import { avisoMargenDescuento } from "./descuentos-orden";
import type { PropuestaItem } from "./propuestas";

function item(
  margen: number | null | undefined,
  { copiado = false, descuento = 80 } = {},
): PropuestaItem {
  return {
    id: "producto-ficticio",
    productoNombre: "Producto de ejemplo",
    cantidad: 1,
    subtotal: 1000 - descuento,
    descuentoInput: { tipo: "PORCENTAJE", valor: 8 },
    jobContext: copiado ? { _centroCopiado: { modo: "HOJAS", version: 1 } } : {},
    cotizacion: {
      desglosePrecio: {
        precioNetoTotal: 1000 - descuento,
        margenEfectivoPct: margen,
        descuento: {
          aplicado: descuento > 0,
          montoTotal: descuento,
          netoListaTotal: 1000,
        },
      },
    },
  } as unknown as PropuestaItem;
}

describe("aviso de margen después de descontar", () => {
  it.each([undefined, null, NaN, Infinity, -Infinity])(
    "un margen ausente o no verificable (%s) no equivale a 0%%",
    (margen) => expect(avisoMargenDescuento([item(margen)], true)).toBeNull(),
  );

  it("el descuento del 8% en copiado no dispara el aviso de margen del motor general", () => {
    const copiado = item(0, { copiado: true });
    expect(avisoMargenDescuento([copiado], true)).toBeNull();
    expect(copiado.subtotal).toBe(920);
    expect(copiado.descuentoInput?.valor).toBe(8);
  });

  it("en pedidos mixtos evalúa sólo los productos ajenos a copiado", () => {
    expect(avisoMargenDescuento([item(0, { copiado: true }), item(35)], true)).toBeNull();
    expect(avisoMargenDescuento([item(0, { copiado: true }), item(11.2)], true))
      .toBe("El margen queda en 11,2% en el producto más ajustado. Revisá antes de emitir.");
  });

  it("no muestra porcentajes sin permiso para ver márgenes", () => {
    expect(avisoMargenDescuento([item(2)], false)).toBeNull();
  });

  it.each([0, -5, 14.9])("conserva el aviso para un margen real de %s%% en catálogo", (margen) => {
    expect(avisoMargenDescuento([item(margen)], true)).toContain(
      `${margen.toLocaleString("es-AR")}%`,
    );
  });

  it("no avisa en el umbral, por encima, sin descuento ni sin productos", () => {
    expect(avisoMargenDescuento([item(15), item(30)], true)).toBeNull();
    expect(avisoMargenDescuento([item(0, { descuento: 0 })], true)).toBeNull();
    expect(avisoMargenDescuento([], true)).toBeNull();
  });
});
