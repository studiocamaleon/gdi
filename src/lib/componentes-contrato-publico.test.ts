import { describe, expect, it } from "vitest";
import {
  condicionalesPublicosDelComponente,
  parametrosPublicosDelComponente,
} from "./componentes-contrato-publico";
import type { FormularioCotizacionProducto } from "./productos-servicios-api";

function formularioFixture(): FormularioCotizacionProducto {
  return {
    producto: {
      id: "lona",
      codigo: "LONA-BACKLIGHT",
      nombre: "Lona Backlight",
      unidadComercial: "unidad",
    },
    cantidad: {
      jobContextKey: "cantidad",
      unidad: "unidad",
      minimo: null,
    },
    medidas: {
      modo: "LIBRE",
      ejes: ["ANCHO", "ALTO"],
      instruccion: "pedir_ancho_alto",
      unidadEntrada: "mm",
      jobContextKeys: [
        "medidaCustomMm.anchoMm",
        "medidaCustomMm.altoMm",
      ],
      predefinidas: [],
      default: null,
    },
    preguntas: [
      {
        tipo: "modo_color",
        jobContextKey: "modoColor_impresion",
        etiqueta: "Modo de impresión",
        requerido: true,
      },
    ],
    adicionales: [
      {
        id: "paso-diseno",
        tipo: "paso",
        nombre: "Diseño gráfico",
        jobContextKey: "opcionalesActivados.paso-diseno",
      },
      {
        id: "paso-tinta-blanca",
        tipo: "paso_condicional",
        nombre: "Tinta blanca",
        jobContextKey: "",
        condicionadoPor: ["modoColor_impresion"],
      },
      {
        id: "cargo-envio",
        tipo: "cargo_cotizacion",
        nombre: "Envío",
        jobContextKey: "opcionalesActivados.cargo-envio",
      },
    ],
    outputsPublicos: [],
  };
}

describe("contrato público de componentes", () => {
  it("publica los pasos opcionales desmarcados para decidirlos al cotizar", () => {
    const bindings = parametrosPublicosDelComponente(formularioFixture(), 1);
    expect(
      bindings.find(
        (binding) =>
          binding.clave === "opcionalesActivados.paso-diseno",
      ),
    ).toEqual(
      expect.objectContaining({
        etiqueta: "Diseño gráfico",
        tipoDato: "boolean",
        origen: "COTIZACION",
        valor: false,
      }),
    );
    expect(
      bindings.some(
        (binding) => binding.clave === "opcionalesActivados.cargo-envio",
      ),
    ).toBe(false);
  });

  it("conserva los condicionales como automatismos y no como interruptores", () => {
    const formulario = formularioFixture();
    const bindings = parametrosPublicosDelComponente(formulario, 1);
    expect(
      bindings.some(
        (binding) => binding.clave.includes("paso-tinta-blanca"),
      ),
    ).toBe(false);
    expect(condicionalesPublicosDelComponente(formulario)).toEqual([
      {
        id: "paso-tinta-blanca",
        nombre: "Tinta blanca",
        condicionadoPor: ["modoColor_impresion"],
      },
    ]);
  });
});
