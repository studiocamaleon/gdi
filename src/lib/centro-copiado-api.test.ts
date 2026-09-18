import { describe, expect, it } from "vitest";
import {
  cantidadLibrosCentroCopiado,
  itemConstruidoAPropuestaItem,
  type ItemConstruido,
} from "./centro-copiado-api";

it("conserva el producto CAD, la ruta y la selección al agregarlo a una OT", () => {
  const jobContext = {
    _centroCopiado: {
      modo: "CAD",
      productoNombre: "Plano CAD impreso",
      productoCodigo: "PLANO-CAD",
      paginas: 2,
      paginasOriginales: 3,
      rangoPaginas: "1-2",
      copias: 2,
      cad: { perfilId: "perfil-color", versionPerfil: 2, versionDestino: 3 },
    },
  };
  const item = itemConstruidoAPropuestaItem({
    documentoId: "doc",
    grupoTomoId: null,
    nombre: "Planos.pdf",
    productoId: "producto-cad",
    jobContext,
    especificaciones: { Escala: "100%" },
    cantidad: 4,
    unidad: "unidad",
    precioUnitario: 100,
    subtotal: 400,
    impuestoPorcentaje: 21,
    impuestoMonto: 84,
    total: 484,
    error: null,
    cotizacion: {
      rutaAlternativaId: "ruta-cad",
    } as ItemConstruido["cotizacion"],
  });
  expect(item).toMatchObject({
    productoNombre: "Plano CAD impreso",
    productoCodigo: "PLANO-CAD",
    motorCodigo: "producto-cad",
    rutaAlternativaId: "ruta-cad",
    cantidad: 4,
    unidadMedida: "unidad",
    precioUnitario: 100,
    total: 484,
    jobContext,
  });
});

describe("cantidadLibrosCentroCopiado", () => {
  it("usa copias para un documento suelto anillado, no sus hojas físicas", () => {
    expect(
      cantidadLibrosCentroCopiado({
        cantidad: 56,
        _centroCopiado: {
          version: 1,
          esTomo: false,
          terminaciones: ["Anillado"],
          copias: 1,
          paginas: 112,
          hojas: 56,
        },
      }),
    ).toBe(1);
  });

  it("usa juegos para un tomo anillado", () => {
    expect(
      cantidadLibrosCentroCopiado({
        _centroCopiado: {
          version: 1,
          esTomo: true,
          terminaciones: ["Anillado"],
          juegos: 3,
          hojas: 168,
        },
      }),
    ).toBe(3);
  });

  it("no interviene en impresiones sin anillado", () => {
    expect(
      cantidadLibrosCentroCopiado({
        _centroCopiado: {
          version: 1,
          esTomo: false,
          terminaciones: [],
          copias: 1,
          hojas: 56,
        },
      }),
    ).toBeNull();
  });
});
